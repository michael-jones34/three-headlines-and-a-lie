# Project Specification

## 1. Objective

This project explores how effectively different machine learning approaches can identify a fabricated headline from a set of four headlines, where three are genuine and one has been intentionally fabricated as part of a quiz format.

The project will compare a range of approaches, including traditional machine learning models, transformer-based models, and frontier large language models using zero-shot reasoning. The final output will be an application where users can play the headline identification game and compare their performance against the different models.

## 2. Scope

### In scope (MVP)
- Curate a dataset containing the results
- Train a range of models on the data
- Test different model embeddings
- Evaluate model performance
- Create lightweight user facing app
- Implement the game within the app
- Give app access to evaluated model performance for comparison with player
- Document methodology and results

### Not in scope
- Full commercial application
- Creating a general fake news detection system
- Mobile application

## 3. Data

### Source
- Morning Brew email archive

### Data representation  
- A headline with an associated class denoting whether it is real or fabricated

### Dataset requirements
- Sufficient examples to create training and evaluation datasets
- Appropriate consideration of how data is split to provide fair evaluation, including potential chronological implications

### Preparation
- Cleaning
- Deduplication
- Train/validation/test split

### Assumptions/limitations
- Data will be freely available from Morning Brew archives (alternative source will be used if not)
- Dataset size is expected to be relatively small

## 4. Machine Learning Approach

### Prediction task
- Out of a set of four headlines, assign probabilities for which one is fabricated

### Families of approaches to compare along with rationale for choice
| Approach | Rationale |
| --- | --- |
| Random guess | Baseline case for comparison, should yield ~25% correct |
| Bag of words TF-IDF + Logistic regression | Classical machine learning, very low training compute required |
| Sentence embeddings + Logistic regression | Captures some semantic meaning but not as intensive as deep learning |
| Trained vanilla neural network | Base level deep learning approach |
| Fine-tuned pretrained transformer (e.g. DistilBERT) | Deep learning with specialised neural network architecture |
| Frontier LLMs | Represents current state-of-the-art general language models |

The project aims to investigate how increasing model sophistication affects performance on the task, and whether additional complexity results in meaningful gains.

## 5. Evaluation

| Question                                                            | Metric                                |
|---------------------------------------------------------------------|---------------------------------------|
| What is the overall predictive performance of the given model type? | Accuracy of predictions               |
| How confident is the given model in each of its predictions?        | Probability of individual predictions |
| Does confidence correlate with correctness?                         | Analysis of relationship between confidence and correctness               |

## 6. Application

### Core MVP
- App implemented in Gradio
- Introductory screen for user to select number of rounds
- User presented with set of four headlines and they choose which one they think is fake
- Colour coded feedback depending on correct or incorrect choice
- At end of game, user given score and compared against ML models' performance

## 7. Future Extensions

### Data and ML
- Automated data scraping from incoming emails
- Include more models if it feels valuable
- Periodic model retraining
- ML explainability where possible

### For the application
- Live leaderboard
- Hyperlinks included to news stories after choices are made
- Persistent user statistics
- More advanced styling and hosting
- Show model confidence and explainability results