from dotenv import load_dotenv
import requests
import os
from firecrawl import Firecrawl
from IPython.display import Markdown, display
import json
from datetime import datetime
import re
from urllib.parse import urlsplit
import time

load_dotenv("../.env")

api_key = os.getenv("FIRECRAWL_API_KEY")

quizzes = {}

first_thursday = datetime.fromisoformat("2020-11-05").date()
first_worded_slug = datetime.fromisoformat("2021-09-30").date()
valid_weekdays = [3,5] # Thursday, Saturday

def processed_date(item):
    return datetime.strptime((item["date"].split("T"))[0],"%Y-%m-%d").date()

def scrape_archive_metadata():
    client = Firecrawl(api_key=api_key)

    result = client.scrape(
        "https://www.morningbrew.com/api/sanity/issues/archive?end=3000",
        formats=["markdown"]
    )

    return json.loads(result.markdown.strip("'`json\n"))

def selection_logic(date):
    if date.weekday() not in valid_weekdays:
        return False
    elif date.weekday() == 3 and date >= first_thursday:
        if date >= first_worded_slug:
            return True
        else:
            return True
    elif date.weekday() == 5 and date < first_thursday:
        return True
    else:
        return False

def extract_slug(item, date):
    if date.weekday() not in valid_weekdays:
        return None
    elif date.weekday() == 3 and date >= first_thursday:
        if date >= first_worded_slug:
            return item["slug"]
        else:
            return item["slug"].replace("/", "%2F")
    elif date.weekday() == 5 and date < first_thursday:
        return item["slug"].replace("/", "%2F")

def scrape_issue(slug):
    client = Firecrawl(api_key=api_key)
    scraped_issue = client.scrape(
        f"https://www.morningbrew.com/issues/{slug}",
        formats=["markdown"]
    )

    return scraped_issue

def cut_before_and_split(scraped_issue, date):
    if date >= first_thursday:
        quiz_section_start_index = scraped_issue.markdown.lower().find("three headlines and a lie")
    if date < first_thursday:
        quiz_section_start_index = scraped_issue.markdown.lower().find("saturday headlines")
    quiz_section = scraped_issue.markdown[quiz_section_start_index:]
    return quiz_section.split("<br>")

def filter_parts(parts):
    # Define what is being looked for to identify a question or answer and store only those parts
    seeking = ["1. ", "2. ", "3. ", "4. "]
    answer_search = re.compile(r'\banswer\b')
    answers_search = re.compile(r'\banswers\b')

    return [item for item in parts if any(term in item.lower() for term in seeking) or answer_search.search(item.lower()) or answers_search.search(item.lower())]

def clean_q4_and_answer(questions_and_answers):

    # Find the answer and extract and store it
    if len(questions_and_answers) == 4:
        answer_rough = questions_and_answers[3].lower().split("answer")[1]
        answer = answer_rough.strip(" |\n")
        questions_and_answers.append(answer)
        
    else:
        answer_index = questions_and_answers[4].lower().find("answer")
        answer_rough = questions_and_answers[4][answer_index:]
        answer_parts = answer_rough.split("|")
        answer_parts_stripped = [item.strip().strip("\n-") for item in answer_parts]
        answer_parts_stripped[0] = ""
        answer_list = []
        [answer_list.append(item) for item in answer_parts_stripped if item]
        answer = answer_list[0]
        questions_and_answers[4] = answer

    # Clean up question 4
    questions_and_answers[3] = (questions_and_answers[3].split("|"))[0]
    return questions_and_answers

def url_headline_extract(index, questions_and_answers):
    url_re = re.compile(r'(\(.*\))')
    url = url_re.search(questions_and_answers[index]).group().strip("()")
    headline = questions_and_answers[index].replace(url, "").replace("()", "").replace("[", "").replace("]", "")

    if "morningbrew" in url:
        url = urlsplit(requests.get(url, allow_redirects=False, timeout=10).headers.get("Location"))._replace(query="").geturl()

    if any(term in headline for term in ["“", "”"]):
        headline_re = re.compile(r'(“.*”)')
        headline = headline_re.search(headline).group().strip("“”")
    else:
        headline = headline.lstrip("1234. ")
    return headline, url

def main():

    full_archive_metadata = scrape_archive_metadata()
    quizzes = []

    for index, item in enumerate(full_archive_metadata):
        date = processed_date(item)
        if selection_logic(date):
            print("Processing issue with quiz")
            issue_metadata = full_archive_metadata[index]
            id = issue_metadata["_id"]
            slug = extract_slug(issue_metadata, date)
            scraped_issue = scrape_issue(slug)
            print("Issue scraped")
            parts = cut_before_and_split(scraped_issue, date)
            questions_and_answers = filter_parts(parts)
            questions_and_answers = clean_q4_and_answer(questions_and_answers)

            quiz = {
                    "id": id,
                    "issue_date": date.isoformat(),
                    "source_url": f"https://www.morningbrew.com/issues/{slug}",
                    "headlines": [],
                    "answer": questions_and_answers[4]
                }

            print("Extracting headline text and URLs")
            for index, item in enumerate(questions_and_answers):
                if item[0].isalpha():
                    continue
                else:
                    headline, url = url_headline_extract(index, questions_and_answers)
                    quiz["headlines"].append({"text": headline, "url": url})

            print(json.dumps(quiz, indent=2))

            quizzes.append(quiz)

            time.sleep(6) # Buffer to avoid hitting Firecrawl rate limit

if __name__ == "__main__":
    main() 