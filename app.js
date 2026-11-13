const express = require('express');
const { Pool } = require('pg');
const path = require('node:path');

const app = express();
const categories = ['授業', '課外活動', 'その他'];

if (!process.env.DATABASE_URL) {
  console.error('.env に DATABASE_URL を設定してください。');
  process.exit(1);
}
const db = new Pool({ connectionString: process.env.DATABASE_URL });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));

//質問一覧
app.get('/', async (req, res) => {
  const keyword = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const category = categories.includes(req.query.category) ? req.query.category : '';

  const { rows: questions } = await db.query(
    `SELECT id, title, author, category
     FROM questions
     WHERE (strpos(lower(title), lower($1)) > 0
        OR strpos(lower(body), lower($1)) > 0)
      AND ($2 = '' OR category = $2)
     ORDER BY created_at DESC, id DESC`,
    [keyword, category]
  );

  res.render('index', { questions, keyword, category, categories });
});

//質問を新しく作る
app.get('/questions/new', (req, res) => {
  res.render('new', { categories, values: {}, error: '' });
});

//質問の編集
app.get('/questions/:id/edit', async (req, res) => {
  const id = Number(req.params.id);
  if (!/^\d+$/.test(req.params.id) || id < 1 || id > 2147483647) {
    return res.status(404).render('error', { message: '質問が見つかりません。' });
  }
  const { rows: [question] } = await db.query(
    'SELECT * FROM questions WHERE id = $1', [id]
  );
  if (!question) {
    return res.status(404).render('error', { message: '質問が見つかりません。' });
  }
  res.render('edit', { question, categories });
});

//編集内容を保存する（POST）
app.post('/questions/:id/edit', async (req, res) => {
  const id = Number(req.params.id);
  if (!/^\d+$/.test(req.params.id) || id < 1 || id > 2147483647) {
    return res.status(404).render('error', { message: '質問が見つかりません。' });
  }

  const values = {};
  for (const field of ['title', 'body', 'category']) {
    const input = req.body?.[field];
    values[field] = typeof input === 'string' ? input.trim() : '';
  }
  const { title, body, category } = values;

  if (!title || !body || !categories.includes(category)) {
    return res.status(400).render('error', {
      message: 'タイトルと質問内容を入力し、カテゴリを選んでください。'
    });
  }

  const result = await db.query(
    'UPDATE questions SET title = $1, body = $2, category = $3 WHERE id = $4',
    [title, body, category, id]
  );

  if (result.rowCount === 0) {
    return res.status(404).render('error', { message: '質問が見つかりません。' });
  }

  res.redirect(303, '/questions/' + id);
});

//投稿するボタンを押された時に画面が移動して、投稿する画面の処理
app.post('/questions', async (req, res) => {
  const values = {};
  for (const field of ['title', 'body', 'author', 'category']) {
    const input = req.body?.[field];
    values[field] = typeof input === 'string' ? input.trim() : '';
  }
  const { title, body, author, category } = values;
  if (!title || !body || !author || !categories.includes(category)) {
    return res.status(400).render('new', {
      categories,
      values,
      error: 'すべての項目を入力し、カテゴリを選んでください。'
    });
  }

  const { rows } = await db.query(
    'INSERT INTO questions (title, body, author, category) VALUES ($1, $2, $3, $4) RETURNING id',
    [title, body, author, category]
  );
  res.redirect(303, '/questions/' + rows[0].id);
});

//質問のうちの一つをクリックして見た時の処理
app.get('/questions/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!/^\d+$/.test(req.params.id) || id < 1 || id > 2147483647) {
    return res.status(404).render('error', { message: '質問が見つかりません。' });
  }
  const { rows: [question] } = await db.query(
    'SELECT * FROM questions WHERE id = $1', [id]
  );
  if (!question) {
    return res.status(404).render('error', { message: '質問が見つかりません。' });
  }
  const { rows: answers } = await db.query(
    'SELECT id, author, body FROM answers WHERE question_id = $1 ORDER BY created_at ASC, id ASC',
    [id]
  );
  res.render('detail', { question, answers });
});

// 質問への回答を保存する
app.post('/questions/:id/answers', async (req, res) => {
  const id = Number(req.params.id);
  if (!/^\d+$/.test(req.params.id) || id < 1 || id > 2147483647) {
    return res.status(404).render('error', { message: '質問が見つかりません。' });
  }

  const author = typeof req.body?.author === 'string' ? req.body.author.trim() : '';
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';

  if (!author || !body) {
    return res.status(400).render('error', {
      message: '回答者名と回答内容を入力してください。'
    });
  }

  const result = await db.query(
    `INSERT INTO answers (question_id, author, body)
     SELECT id, $2, $3 FROM questions WHERE id = $1`,
    [id, author, body]
  );

  if (result.rowCount === 0) {
    return res.status(404).render('error', { message: '質問が見つかりません。' });
  }

  res.redirect(303, '/questions/' + id);
});

// 質問を削除する
app.post('/questions/:id/delete', async (req, res) => {
  const id = Number(req.params.id);
  if (!/^\d+$/.test(req.params.id) || id < 1 || id > 2147483647) {
    return res.status(404).render('error', { message: '質問が見つかりません。' });
  }

  const result = await db.query(
    'DELETE FROM questions WHERE id = $1',
    [id]
  );

  if (result.rowCount === 0) {
    return res.status(404).render('error', { message: '質問が見つかりません。' });
  }

  res.redirect(303, '/');
});

// 指定された質問の回答を1件削除する
app.post('/questions/:id/answers/:answerId/delete', async (req, res) => {
  const questionId = Number(req.params.id);
  const answerId = Number(req.params.answerId);

  for (const value of [req.params.id, req.params.answerId]) {
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 2147483647) {
      return res.status(404).render('error', { message: '回答が見つかりません。' });
    }
  }

  const result = await db.query(
    'DELETE FROM answers WHERE question_id = $1 AND id = $2',
    [questionId, answerId]
  );

  if (result.rowCount === 0) {
    return res.status(404).render('error', { message: '回答が見つかりません。' });
  }

  res.redirect(303, '/questions/' + questionId);
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(error.message);
  res.status(500).render('error', { message: '処理中にエラーが発生しました。' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('http://localhost:' + port));
