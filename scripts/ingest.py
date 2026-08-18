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

first_thursday = datetime.fromisoformat("2020-11-05").date()
first_worded_slug = datetime.fromisoformat("2021-09-30").date()
valid_weekdays = [3,5] # Thursday, Saturday

data_path = "../data"

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

def extract_slug(edition_metadata, date):
    if date.weekday() not in valid_weekdays:
        return None
    elif date.weekday() == 3 and date >= first_thursday:
        if date >= first_worded_slug:
            return edition_metadata["slug"]
        else:
            return edition_metadata["slug"].replace("/", "%2F")
    elif date.weekday() == 5 and date < first_thursday:
        return edition_metadata["slug"].replace("/", "%2F")

def scrape_edition(slug):
    client = Firecrawl(api_key=api_key)
    scraped_edition = client.scrape(
        f"https://www.morningbrew.com/issues/{slug}",
        formats=["markdown"]
    )

    return scraped_edition

def filter_parts(scraped_edition):
    split_quiz = scraped_edition.markdown.split("<br>")
    # Define what is being looked for to identify a question or answer and store only those parts
    q_search = re.compile(r'[1234]\. (“)?.*\[([\w\s\.\-])*\](\(.*\))')
    answer_search = re.compile(r'(\banswer)(s?)(\b)')

    questions_and_answers = [item for item in split_quiz if q_search.search(item.lower()) or (answer_search.search(item.lower()) and item.startswith("[morningbrew.com"))]

    if len(questions_and_answers) > 5:
        del questions_and_answers[5:]

    return questions_and_answers

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
    headline = questions_and_answers[index].replace(url, "").replace("()", "").replace("[", "").replace("]", "").lstrip("1234. “").rstrip("”")

    if "morningbrew" in url:
        url = urlsplit(requests.get(url, allow_redirects=False, timeout=10).headers.get("Location"))._replace(query="").geturl()

    return headline, url

def process_edition(index, full_archive_metadata, date, archive, quizzes):
    edition_metadata = full_archive_metadata[index]
    id = edition_metadata["_id"]
    slug = extract_slug(edition_metadata, date)
    scraped_edition = scrape_edition(slug)
    print("Edition scraped")
    edition = {
        "_id" : id,
        "date" : date.isoformat(),
        "slug" : slug,
        "content" : scraped_edition.markdown
    }

    archive.append(edition)

    questions_and_answers = filter_parts(scraped_edition)
    questions_and_answers = clean_q4_and_answer(questions_and_answers)

    quiz = {
            "_id": id,
            "edition_date": date.isoformat(),
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

    quizzes.append(quiz)

    print(json.dumps(quiz, indent=2))

    with open(f"{data_path}/archive.json", "w") as f:
        json.dump(archive, f, indent=2)

    with open(f"{data_path}/quizzes.json", "w") as f:
        json.dump(quizzes, f, indent=2)

    time.sleep(6)

def edition_condition_and_store(date, index, full_archive_metadata):

    # Check to see if archive exists, if not create blank list
    if os.path.isfile(f"{data_path}/archive.json"):
        with open(f"{data_path}/archive.json", "r") as f:
            archive = json.load(f)
    else:
        archive = []
    if os.path.isfile(f"{data_path}/quizzes.json"):
            with open(f"{data_path}/quizzes.json", "r") as f:
                quizzes = json.load(f)
    else:
        quizzes = []

    iso_date = date.isoformat()

    if any(archive_edition["date"] == iso_date for archive_edition in archive):
        print(f"Edition for {iso_date} found")
        return
    else:
        process_edition(index, full_archive_metadata, date, archive, quizzes)

def main():

    full_archive_metadata = scrape_archive_metadata()

    for index, item in enumerate(full_archive_metadata):
        # if index < 395:
        #     continue

        date = processed_date(item)

        if selection_logic(date):
            print("Processing edition with quiz")
            edition_condition_and_store(date, index, full_archive_metadata)

if __name__ == "__main__":
    main() 