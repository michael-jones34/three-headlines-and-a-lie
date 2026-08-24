from dotenv import load_dotenv
import requests
import os
from firecrawl import Firecrawl
import json
from datetime import datetime
import re
from urllib.parse import urlsplit
import time
import traceback

load_dotenv("../.env")

api_key = os.getenv("FIRECRAWL_API_KEY")

client = Firecrawl(api_key=api_key)

first_thursday = datetime.fromisoformat("2020-11-05").date()
first_worded_slug = datetime.fromisoformat("2021-09-30").date()
first_quiz = datetime.fromisoformat("2019-10-26").date()
valid_weekdays = [3,5] # Thursday, Saturday

data_path = "../data"

def processed_date(item):
    return datetime.strptime((item["date"].split("T"))[0],"%Y-%m-%d").date()

def scrape_archive_metadata(client):
    result = client.scrape(
        "https://www.morningbrew.com/api/sanity/issues/archive?end=100000",
        formats=["markdown"]
    )

    return json.loads(result.markdown.strip("'`json\n"))

def selection_logic(date):
    ignore = ["2024-12-26", # Special edition with Golden Mug awards, no quiz
              "2023-12-28", # Special edition with photos of the year, no quiz
              "2023-04-13", # Tax edition, they're not really headlines
              "2023-01-05", # Tax edition, they're not really headlines
              "2022-03-24", # Has a quiz with three real musical acts and one fake one from Lollapalooza
              "2021-01-07", # No quiz as it was the day after January 6th
              "2020-12-24"] # Had a different quiz
    iso_date = date.isoformat()
    if date.weekday() not in valid_weekdays:
        return False
    elif iso_date in ignore:
        return False
    elif date.weekday() == 3 and date >= first_thursday:
        return True
    elif date.weekday() == 5 and date < first_thursday and date >= first_quiz:
        return True
    else:
        return False

def extract_slug(edition_metadata, date):
    if date.weekday() == 3 and date >= first_thursday:
        if date >= first_worded_slug:
            return edition_metadata["slug"]
        else:
            return edition_metadata["slug"].replace("/", "%2F")
    else:
        return edition_metadata["slug"].replace("/", "%2F")

def scrape_or_load_edition(client, slug, edition_id, iso_date, archive):

    if any(archive_edition["date"] == iso_date for archive_edition in archive):
        print(f"Edition for {iso_date} found")
        edition = next(archive_edition for archive_edition in archive if archive_edition["date"] == iso_date)
        scraped_edition = edition["content"]
        return scraped_edition

    else:
        scraped_edition = client.scrape(
            f"https://www.morningbrew.com/issues/{slug}",
            formats=["markdown"]
        ).markdown

        time.sleep(6) # To buffer Firecrawl requests

        print("Edition scraped")
        
        edition = {
            "_id" : edition_id,
            "date" : iso_date,
            "slug" : slug,
            "content" : scraped_edition
        }

        append_and_store_edition(edition, archive)

        return scraped_edition

def filter_and_clean_parts(scraped_edition):
    split_quiz = scraped_edition.split("<br>")

    # Looking for question structure as per "1. Knicks blowout prompts NYC bar to [slash](https://links.morningbrew.com/c/Qbk?mblid=b89ba0a52c84&mbnlid=pe857ob96pFFOtePNArveW)"
    q_search = re.compile(r'^[1234]\. (“)?.*\[([^\]]*)\](\(.*\))')
    answer_search = re.compile(r'(\banswer)(s?)(\b)')
    answer_hash_search = re.compile(r'(\s### answer)(s)?')
    answer_hash_search2 = re.compile(r'(\s# \[answer\])(s)?')
    answer_saturday_hash_search = re.compile(r'(\s### saturday headline)(s)?( answer)(s)?')

    questions_and_answers = [item for item in split_quiz if q_search.search(item.lower())]

    if len (questions_and_answers) > 4:
        del questions_and_answers[:-4]

    if answer_search.search(questions_and_answers[3].lower()) or answer_hash_search.search(questions_and_answers[3].lower()) or answer_hash_search2.search(questions_and_answers[3].lower()):
        answer_rough = questions_and_answers[3].lower().split("answer")[1]
        answer = answer_rough.strip(" |\n")
        questions_and_answers.append(answer)
    else:
        answer = [item for item in split_quiz if (answer_search.search(item.lower()) and item.startswith("[morningbrew.com")) 
                                                or answer_hash_search.search(item.lower())
                                                or answer_hash_search2.search(item.lower())
                                                or answer_saturday_hash_search.search(item.lower())][0]

        answer_index = answer.lower().find("answer")
        answer_rough = answer[answer_index:]
        answer_parts = answer_rough.split("|")
        answer_parts_stripped = [item.strip().strip("\n-") for item in answer_parts]
        answer_parts_stripped[0] = ""
        answer_list = [item for item in answer_parts_stripped if item]
        answer = answer_list[0]
        if "answer" in answer.lower():
            answer = answer_list[1]
        questions_and_answers.append(answer)

    # Clean up question 4
    questions_and_answers[3] = (questions_and_answers[3].split("|"))[0]

    return questions_and_answers

def url_headline_extract(index, questions_and_answers):
    url = re.compile(r'(\(.*?\))').search(questions_and_answers[index]).group().strip("()")
    headline = questions_and_answers[index].replace(url, "").replace("()", "").replace("[", "").replace("]", "").lstrip("1234. “").rstrip("”")

    # Take the link that the Morning Brew link points to if it is a Morning Brew type url
    if "morningbrew" in url:
        url = urlsplit(requests.get(url, allow_redirects=False, timeout=10).headers.get("Location"))._replace(query="").geturl()
    # Remove Morning Brew tracking information if it exists
    else:
        url = urlsplit(url)._replace(query="").geturl()

    return headline, url

def process_edition(index, full_archive_metadata, date, archive, iso_date):
    edition_metadata = full_archive_metadata[index]
    edition_id = edition_metadata["_id"]
    slug = extract_slug(edition_metadata, date)

    scraped_edition = scrape_or_load_edition(client, slug, edition_id, iso_date, archive)

    questions_and_answers = filter_and_clean_parts(scraped_edition)

    quiz = {
            "_id": edition_id,
            "date": date.isoformat(),
            "source_url": f"https://www.morningbrew.com/issues/{slug}",
            "headlines": [],
            "answer": questions_and_answers[4]
        }

    print("Extracting headline text and URLs")
    for index in range(4):
        headline, url = url_headline_extract(index, questions_and_answers)
        quiz["headlines"].append({"text": headline, "url": url})
       
    print(json.dumps(quiz, indent=2))

    return quiz

def append_and_store_edition(edition, archive):

    archive.append(edition)

    archive.sort(key=lambda x: x["date"])

    with open(f"{data_path}/archive.json", "w") as f:
        json.dump(archive, f, indent=2)

def append_and_store_quiz(quiz, quizzes):

    quizzes.append(quiz)

    quizzes.sort(key=lambda x: x["date"])

    with open(f"{data_path}/quizzes.json", "w") as f:
        json.dump(quizzes, f, indent=2)

def check_existence_process_append_store(date, index, full_archive_metadata, exceptions):

    # Check to see if archive and quizzes exist, if not create blank list
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

    if any(quizzes_edition["date"] == iso_date for quizzes_edition in quizzes):
        print(f"Quiz for {iso_date} found")
        return
    else:
        try:
            quiz = process_edition(index, full_archive_metadata, date, archive, iso_date)
            append_and_store_quiz(quiz, quizzes)
        except Exception as e:
            print(f"Failed to process {date}: {e}")
            exception = {
                "Date" : iso_date,
                "Exception" : traceback.format_exc().splitlines()
            }
            exceptions.append(exception)
            with open(f"{data_path}/exceptions.json", "w") as f:
                json.dump(exceptions, f, indent=2)

def main():

    full_archive_metadata = scrape_archive_metadata(client)
    exceptions = []

    for index, item in enumerate(full_archive_metadata):
  
        date = processed_date(item)

        if selection_logic(date):
            print("Processing edition with quiz")
            check_existence_process_append_store(date, index, full_archive_metadata, exceptions)

if __name__ == "__main__":
    main() 