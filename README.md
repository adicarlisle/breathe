# Breathe

Free tools for cutting down on smoking, live at **[bigthought.ai/smoking-calculator](https://bigthought.ai/smoking-calculator)**:

- **Cost calculator**: what smoking or vaping costs you per week, month and year.
- **Vape analyser** (`/smoking-calculator/vape-analyser`): reads a bank statement (CSV, or PDF through the bundled PDF.js) and finds vape purchases with a small logistic-regression model. Everything happens in your browser, and the statement is never uploaded.
- **Tracker** (`/smoking-calculator/tracker`): an installable app with a big "I smoked a cigarette" button. Entries stay in your browser's local storage.

Health figures are in `public/health.js`, with their sources (Hackshaw et al., BMJ 2018; Inoue-Choi et al. 2017; OHID 2022). Breathe gives information, not medical advice. For help to stop smoking, see [NHS Quit Smoking](https://www.nhs.uk/better-health/quit-smoking/).

## Run it

Node.js 24 or later, with no dependencies:

```sh
npm start          # http://localhost:8080/smoking-calculator
npm test
npm run train:vape # retrain the vape classifier from model/data.js
```

Or with Docker: `docker build -t breathe . && docker run -p 8080:8080 breathe`.

## Licence

The code is MIT licensed (see `LICENSE`). PDF.js in `public/vendor/` is Apache 2.0 (see `public/vendor/pdfjs-LICENSE`). The BigThought name and logo aren't covered by the licence.

This repository is a copy of the app's folder in bigthought.ai's main (private) repository, refreshed when the app changes.
