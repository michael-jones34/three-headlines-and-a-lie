# 1. Introduction

This is a portfolio project developed to demonstrate full-stack software engineering capabilities, with a particular focus on data science and machine learning (ML). The project is based on the *Three Headlines and a Lie* quiz published by Morning Brew, in which participants are presented with four unusual-sounding news headlines and must identify the one that has been fabricated. This format provides a simple, engaging classification problem around which to develop and evaluate a range of ML approaches.

The project was selected to provide practical experience across the machine learning development lifecycle, from data collection and curation through model training and evaluation to deployment in a lightweight, user-facing application. The backend was implemented in Python, with the frontend developed using Next.js, React, TypeScript and Tailwind CSS. The frontend uses static export to produce a deployable web application without requiring a continuously running application server. Project planning and task management were conducted through GitHub Issues, providing a structured means of tracking development and managing the project scope.

## 1.1. Scope and Objectives

The project encompasses the following activities:

- **Dataset curation:** Collect and structure a dataset of *Three Headlines and a Lie* questions and their corresponding answers to support model development and evaluation.
- **Model development:** Train a range of machine learning models and approaches, ranging from classical models using TF-IDF features and classifiers using pretrained MiniLM sentence embeddings to fine-tuned transformer and frontier large language models, to predict which headline is fabricated.
- **Model evaluation:** Establish baseline performance, evaluate the trained models using held-out data, and compare their predictive performance and other relevant evaluation metrics.
- **Frontend development:** Build a lightweight web application through which users can play the 3H1L game.
- **Game implementation:** Recreate the quiz format within the application, allowing users to select a headline and receive feedback on their performance.
- **Model comparison:** Integrate the evaluated model results into the application to allow users to compare their own performance against that of the trained models.
- **Documentation:** Record the methodology, experimental design, results and conclusions to support reproducibility, communicate the findings, and identify potential avenues for further development.

The resulting project combines a machine learning experimentation pipeline with a functional web application, providing both a technical demonstration of end-to-end development and an interactive user experience on the 3H1L task.


# 2. Data Acquisition and Preparation

## 2.1. Data Sources and Acquisition Strategy

The objective of the data acquisition stage was to construct a clean, reproducible dataset of *Morning Brew*’s *Three Headlines and a Lie* quizzes for use across multiple machine learning approaches. The intention was to follow a progression of data acquisition, quiz extraction, data cleaning and validation and model-specific preparation, producing a canonical dataset that could support both the modelling workflow and the subsequent web application.

### 2.1.1. Identifying and retrieving relevant issues

The first challenge was identifying which newsletter editions contained the quiz. *Morning Brew* provides an online archive through an API endpoint (`https://www.morningbrew.com/api/sanity/issues/archive?end=100000`), returning issue metadata including publication dates, identifiers and URL slugs. These slugs could be appended to the general newsletter URL to access individual editions. This enabled the relevant historical issues to be enumerated programmatically, avoiding the need to locate and retrieve each edition manually.

The archive was treated as the available source of historical issues rather than a necessarily exhaustive record of every newsletter ever published. The selection process therefore operated over the editions returned by the API, applying additional rules to identify likely quiz issues.

The quiz's publication schedule and naming conventions changed over time. Earlier editions used the title *Saturday Headlines*, with the earliest identified example dated 2019-10-26. This format continued through 2020-10-31, before the regular Thursday version began on 2020-11-05. Further changes to the quiz's URL slug convention occurred with the first quiz to use a named rather than dated slug on 2021-09-30. Candidate selection for editions with quizzes from the API endpoint therefore used publication dates and the appropriate day of the week as its primary basis. Saturday editions from 2019-10-26 to 2020-10-31 and Thursday editions from 2020-11-05 onwards were considered, subject to the subsequent extraction and exclusion rules.

Not every candidate edition contained the standard quiz. Some issues contained special formats, including awards, year-in-review material, subject-specific quizzes and editions with a different number of headlines. These were excluded where they did not represent the same underlying task: identifying one fabricated headline from a set of four. For example, a special edition containing ten headlines did not conform to the intended classification problem, while a CES-themed quiz concerned product concepts rather than ordinary news headlines. Excluding these editions avoided introducing arbitrary editorial decisions simply to force them into the dataset schema.

Direct HTTP requests to the newsletter pages were blocked by Cloudflare, while attempts to retrieve the pages using Playwright were also unsuccessful. Rather than investing further effort in browser automation, an alternative acquisition route was investigated. Firecrawl successfully retrieved the newsletter content as Markdown, allowing the historical collection to be ingested programmatically. Rate limiting during the bulk acquisition process was addressed by introducing a six-second delay between requests.

### 2.1.2. Caching and reproducibility

The scraped newsletter content was retained in `archive.json`, with each entry containing issue metadata and the full Markdown representation of the newsletter. Subsequent runs of the ingestion pipeline could load previously acquired content locally instead of repeatedly querying Firecrawl.

This cache was an important architectural decision. Separating acquisition from extraction allowed the parser to be developed and tested repeatedly against the same source material, without introducing unnecessary network requests or making parser development dependent on an external scraping service. It also made failures easier to diagnose: extraction issues could be investigated using the cached Markdown, without first reproducing the acquisition step.

The resulting workflow was (MAYBE MOVE THIS SOMEWHERE LATER ON AFTER THE LATTER PARTS OF THE WORKFLOW HAVE BEEN INTRODUCED OR REMOVE IT):

`Morning Brew archive API` → `Firecrawl acquisition` → `archive.json` → quiz extraction and cleaning → `quizzes.json` → model-ready transformation → `ml_dataset.json`.

Exploratory work initially took place in notebooks. Once the extraction logic had developed sufficiently, it was consolidated into `scripts/ingest.py`, which became the source of truth for the ingestion pipeline. `test_dataset_creation.ipynb` was retained for testing and debugging the functions imported from the script, avoiding the maintenance of separate implementations. The decision to keep the production ingestion logic in a single script reflected the scale and requirements of the project; a more elaborate package structure was not considered necessary.

## 2.2. Quiz Extraction and Dataset Construction

### 2.2.1. Deterministic parsing of newsletter content

The extracted Markdown contained the entire newsletter including the quiz, so the main parsing task was to isolate the relevant sections and identify the four headlines, their associated links and the answer. The implementation relied on structural patterns in the source material rather than an LLM-based extraction approach.

The quiz generally appeared as four numbered Markdown entries, even where the rendered newsletter displayed them as a lettered list. Each headline included a Markdown hyperlink, with the display text providing the headline and the destination URL linking either to an underlying news article or to a GIF. This distinction supplied a useful deterministic signal for identifying the fabricated headline: genuine headlines generally linked to articles, whereas fake headlines generally linked to GIFs, frequently hosted on Giphy.

The extraction process therefore combined the identification of quiz sections, filtering and parsing of the numbered entries, answer-section handling, extraction of headline text and URLs, and URL cleaning. The final stages assembled the extracted information into a structured record.

Regex-based parsing was useful for identifying the repeated structures, but the historical content exposed limitations in attempting to handle all Markdown syntax through regular expressions alone. In particular, headline text contained varied punctuation, Unicode characters, emoji and other formatting artefacts. Question detection consequently evolved from exact-string matching towards patterns anchored to the beginnings of the relevant Markdown chunks. This reduced false matches against unrelated newsletter headings and made the parser less dependent on the precise wording of individual headlines.

URL extraction provided a particularly clear example of the value of matching the implementation to the actual data. Initial regexes attempted to capture the contents of Markdown link parentheses, but URLs can themselves contain parentheses, and the space after the final parenthesis indicating the end of the link was occasionally absent. Greedy and subsequently non-greedy patterns did not handle all observed cases reliably. The final approach used a small parenthesis-aware parser: starting at the opening parenthesis of a link destination, it tracked the nesting depth until the corresponding closing parenthesis was found. This directly represented the structure being parsed and proved more robust than continuing to expand the regular expression.

Answer formatting presented a related challenge. The answer could appear in a separate Markdown section or be attached to the fourth question, sometimes alongside tables or additional formatting. Answer headings also varied, and the word “answer” occasionally appeared elsewhere in the newsletter. The extraction logic was therefore adapted to the observed structural variations rather than relying on a single fixed heading.

### Data model and fake-headline identification

Each extracted quiz was represented as a structured record containing:

- `issue_date`: the date of the newsletter issue;
- `source_url`: the URL of the original issue;
- `headlines`: four headline objects, each containing its text and source URL;
- `answer`: the extracted answer text.

The record was first tested on an individual quiz and serialised to JSON before being applied across the historical collection. The schema was deliberately kept independent of any particular machine learning model. In particular, the source-level dataset did not contain a numerical fake-headline index or a model-specific target label. Such information was introduced only when creating the separate ML-ready representation.

This separation preserved the source information needed by the application, including the URLs that allow users to inspect the underlying articles, while keeping the canonical data structure independent of how different models would consume it.

The fake-headline index was instead derived in the preparation stage. Because the fake headline almost always linked to a Giphy URL, the presence of `giphy` in the headline URL was used as the primary identification rule. Only two quizzes required explicit exceptions because their fake headlines did not have a Giphy link. These cases were handled directly in the answer-identification function rather than introducing a more complicated text-matching system to cover two exceptions.

This was a pragmatic design decision: the URL-based rule covered the observed data effectively, while the exceptions remained explicit and auditable.

### URL resolution and cleaning

The extracted URLs also required normalisation. More recent issues used *Morning Brew* tracking links that redirected to the underlying article or GIF. Following these redirects with ordinary HTTP requests could result in long waits or failures when the destination site was inaccessible. The pipeline therefore obtained the redirect destination from the HTTP `Location` header without following the redirect to download the destination page.

Unnecessary query parameters and fragments were subsequently removed using Python's `urllib.parse` utilities. This eliminated tracking information that was not required for the project and retained the underlying source URL.

URL validation was deliberately conservative. A URL that could not be accessed from the current environment was not automatically considered invalid: paywalls, regional restrictions, HTTP 403 or 451 responses, and timeouts could affect otherwise legitimate historical links. Conversely, a request returning a successful response was not sufficient to establish that the URL had been extracted correctly. Validation therefore combined URL structure, selected HTTP checks and inspection of suspicious outputs rather than relying on a single reachability test.

## Error Handling, Exceptions and Historical Curation

### Iterative ingestion and error handling

The initial implementation was developed iteratively in notebooks before being extended to process the entire candidate collection. Running the pipeline across the archive initially produced numerous exceptions, many of which stemmed from recurring formatting differences rather than genuinely unique cases.

The full ingestion loop was configured to catch and record processing failures in `exceptions.json`, including traceback information, and continue processing the remaining issues. This prevented a single anomalous newsletter from requiring a complete restart and made it possible to investigate failures after the run had completed.

The resulting development process prioritised errors that affected large numbers of issues and could be corrected through general improvements to the parser. As these were resolved, the remaining failures increasingly represented genuine historical edge cases. The number of exceptions fell from approximately 158 to a small number of anomalies that could be handled more proportionately through explicit exclusions or manual reconstruction.

This approach avoided prematurely complicating the general ingestion logic to accommodate every unusual edition. Where a case was sufficiently isolated, a complete corrected quiz record was added through `manual_quiz_additions.json` rather than introducing another special case into the parser. The unusual bulleted quiz published on 30 June 2022, for example, was reconstructed manually. Keeping complete records for such exceptions made the intervention explicit and prevented a correction from depending on incidental parser behaviour.

Two further files, `known_issues_outstanding.json` and `known_issues_resolved.json`, were used to track validation findings. Each issue could be documented and moved from the outstanding file to the resolved file once its correction had been made. This provided an auditable record of historical anomalies rather than leaving them buried in undocumented changes to the source code.

### Repairing historical source links

Several extracted article and GIF links were no longer available. Approximately 19 links required investigation or replacement. The objective was to preserve the original quiz and headline, replacing only the unusable source link where a suitable alternative could be found. Where appropriate, the Wayback Machine was used to locate an archived version of an article.

Two lightweight automation experiments informed this work. The first used an LLM to generate search terms from a headline, queried Giphy through its API and returned candidate GIFs. Although technically functional, the approach was abandoned in favour of manual selection. The generated queries often interpreted headlines too literally, failing to capture the humorous context that made a reaction GIF appropriate. Giphy's results were also frequently unrelated to the intended joke. Finding a suitable GIF required iterative searching and visual judgement, making the task poorly suited to the proposed automated workflow.

Finding replacement article links was more amenable to partial automation. A lightweight agent was built using the OpenAI Agents SDK, with a web-search function tool that allowed it to search for articles related to a supplied headline and propose replacement URLs. The candidates were then reviewed manually before the dataset was updated.

The experiment also highlighted two practical issues when using agents in a loop. First, intermittent HTTP 403 errors from the search service could lead to repeated tool calls if the failure was returned to the agent as an ordinary tool result. Configuring the function tool with `failure_error_function=None` allowed exceptions to propagate to the calling code, where they could be handled explicitly. Second, the agent initially continued searching after finding a suitable replacement. Adding a clear stopping criterion to the instructions reduced these unnecessary calls.

The article-search experiment was effective, although a simpler programmatic search based directly on the headline might have achieved much of the same result without an LLM. The agent was therefore retained as an experimental aid rather than made a dependency of the production ingestion pipeline. In both experiments, the final decision was to use the simplest reliable approach: manual judgement for GIF selection and manually reviewed search results for article replacement.

## Dataset Validation and Subsequent Corrections

### Structural and content validation

Validation was treated as a separate stage from error handling. A pipeline can execute without raising an exception while still producing incorrect text, malformed URLs or an incorrectly identified answer. Consequently, the dataset was checked for both structural violations and suspicious content.

Structural checks covered the expected fields, valid dates, exactly four headlines per quiz, the presence of headline text and URLs, answer information, duplicate dates and headlines, and sensible URL structure. The expected relationship between fake headlines and GIF links was also checked where applicable.

Content-level anomaly checks sought issues that could survive these structural checks. These included abnormally short or long headlines and answers, leftover Markdown, leading or trailing whitespace, embedded newlines and tabs, non-breaking spaces, suspicious Unicode characters, remnants of numbered-list formatting, malformed URLs and fragments of tracking information. The checks were intended to identify potentially corrupted content without assuming that every deviation from an expected pattern was necessarily an error.

A sample of 30 quizzes, distributed approximately evenly across the dataset's historical range, was also inspected manually. This identified a small number of additional issues, including formatting artefacts and inaccessible or paywalled links. The results supported the general extraction approach, while reinforcing the need to distinguish genuinely malformed data from historical sources that were simply no longer accessible.

The automated and manual checks improved the reliability of the dataset, but they did not identify every defect. A subsequent full-dataset review later in the project exposed errors that had passed the earlier validation process.

### Late discovery of dataset defects

After most model training runs had already been completed, the entire dataset was examined using an LLM-assisted review. This surfaced additional errors, including a bug in the ingestion code that truncated headlines beginning with the characters `1`, `2`, `3` or `4`. It also exposed typographical errors and source-data artefacts that had not been detected by the earlier structural checks or manually sampled inspection.

These findings required a further round of corrections. They demonstrated that successful ingestion, schema validation and spot-checking were not sufficient to establish that every headline had been extracted faithfully. In particular, the truncation bug was a systematic implementation defect rather than a collection of independent source anomalies, while other findings originated in the newsletter content itself or in how that content had been represented in Markdown.

Representative examples of the issues and their treatment are given below.

| Issue category                                 | Example                                                                                                                                                                    | Resolution                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Systematic extraction bug                      | Headlines beginning with `1`, `2`, `3` or `4` were truncated by the ingestion code.                                                                                        | Corrected the extraction logic so the headline text was preserved.                     |
| Character-encoding corruption                  | The 8 February 2020 issue contained text such as `18.3Â°C (65Â°F)`. The 30 June 2022 issue included corrupted ellipsis and apostrophe characters, such as `â€¦` and `â€™`. | Replaced the corrupted sequences with the intended Unicode characters.                 |
| Missing spaces around formatted text and links | The 5 September 2020 issue contained `Tenet_120 times`; other examples included missing spaces in the 13 May 2021 and 6 June 2024 issues.                                  | Corrected the extracted text and spacing.                                              |
| Malformed Markdown remnants                    | The 20 March 2025 issue contained malformed emphasis delimiters around *The Shawshank Redemption*. The 13 November 2025 issue contained literal backslashes in a headline. | Removed the unwanted delimiters and backslashes while retaining the intended headline. |
| Source-data typographical errors               | The 21 March 2024 headline used an incorrect closing quotation mark; the 9 May 2024 headline omitted a possessive apostrophe.                                              | Corrected the affected characters and punctuation.                                     |

These examples illustrate why the final quality-control process needed to consider the content itself, not just whether it satisfied the expected JSON schema. Some defects were best addressed in the general extraction logic, while isolated typographical errors were more appropriately corrected explicitly.

The late corrections also have implications for the interpretation of the modelling results. Model runs performed before these defects were fixed were trained and evaluated on an earlier version of the dataset. Their results therefore describe performance on that snapshot, not necessarily on the corrected dataset. For the final benchmark to be internally consistent, model comparisons should be based on runs against the corrected, frozen dataset, or any results not rerun should be clearly identified as pre-correction results. The later discovery should not be obscured by treating the earlier validation pass as definitive.

## Final Dataset and ML-Ready Transformation

Following extraction, exclusions, manual reconstruction, link correction and validation, the source-level dataset comprised **337 quizzes**. The canonical records were stored in `quizzes.json`, with four headline text-and-URL pairs and the original answer text for each quiz. The raw scraped issues remained available in `archive.json`, while exceptional reconstructed or corrected records were maintained in `manual_quiz_additions.json`.

The model-ready dataset was then generated as a separate transformation. Each record retained the quiz date and four headline texts, together with a zero-based index identifying the fake headline:

```json
{
  "date": "YYYY-MM-DD",
  "headlines": [
    "Headline one",
    "Headline two",
    "Headline three",
    "Headline four"
  ],
  "answer": 2
}
```

The actual headline text and answer index vary by quiz; the example above illustrates the schema only. Source URLs and answer prose were omitted from this representation because they were not required for the core prediction task. The transformation used the URL-based fake-headline identification rule described above, with explicit exceptions for the two quizzes lacking a Giphy link.

This maintained a distinction between the canonical quiz-level dataset and the representations required by individual models. For example, a headline-level classifier could flatten the four headlines into individual examples, whereas a model prompted with the full quiz could process all four headlines together. Such differences belong in model-specific preprocessing rather than in the acquisition pipeline.

An important consequence is that any headline-level train, validation and test split must be made at the quiz level before flattening. Otherwise, headlines from the same quiz could appear in both training and testing data, introducing leakage and overstating generalisation performance.

The ingestion process was also tested by deleting the generated source-level dataset and rebuilding it from the archive, selection rules and recorded exceptions. This checked that the output could be recreated without relying on accumulated notebook state or undocumented manual modifications. The subsequent discovery of silent data defects demonstrated that reproducibility and data correctness are separate requirements: a deterministic pipeline can reliably reproduce an incorrect result if its logic or inputs contain errors. The late corrections therefore form part of the final dataset preparation record, rather than being treated as unrelated modelling changes.

## Summary

The completed data acquisition and preparation workflow combines programmatic issue discovery, Firecrawl-based acquisition, a persistent Markdown cache, deterministic quiz extraction, URL resolution, explicit handling of historical exceptions and layered validation. The principal design choices were to avoid unnecessary complexity in the ingestion code, use the observed structure of the newsletter wherever possible, retain source information separately from model-specific labels, and manage genuine one-off anomalies through documented manual corrections.

The subsequent full-dataset audit also established an important limitation of the original validation strategy: structural correctness and successful execution do not guarantee faithful extraction of every headline. Correcting the truncation bug and source-data anomalies was therefore necessary to establish the final dataset as a defensible basis for evaluation.

The resulting artefacts—`archive.json`, `quizzes.json`, `ml_dataset.json`, `manual_quiz_additions.json` and the associated exception and validation records—separate raw source material, canonical quiz data, model-ready targets and explicit historical interventions. With the corrected dataset established, the next stage is model development and evaluation, using consistent quiz-level data splits and a clearly identified dataset version for comparable results.
