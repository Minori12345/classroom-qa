-- 質問を保存するテーブル
CREATE TABLE IF NOT EXISTS questions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  author text NOT NULL,
  category text NOT NULL CHECK (category IN ('授業', '課外活動', 'その他')),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 回答を保存するテーブル。質問を削除すると、その回答も一緒に消える
CREATE TABLE IF NOT EXISTS answers (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id integer NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  author text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);