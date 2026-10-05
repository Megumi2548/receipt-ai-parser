from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import os
import uuid
import boto3
from google import genai  # ← 最新SDK

import models
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === 環境変数 ===
aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-1")
S3_BUCKET_NAME = os.getenv("AWS_S3_BUCKET_NAME", "hamazaki-image-app-dev")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# クライアント初期化
s3_client = boto3.client(
    's3',
    aws_access_key_id=aws_access_key,
    aws_secret_access_key=aws_secret_key,
    region_name=AWS_REGION
)

textract_client = boto3.client(
    'textract',
    aws_access_key_id=aws_access_key,
    aws_secret_access_key=aws_secret_key,
    region_name='us-east-1'
)

# Gemini 最新クライアント初期化
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

class TaskResponse(BaseModel):
    id: int
    title: str
    image_url: Optional[str] = None
    extracted_text: Optional[str] = None

    class Config:
        from_attributes = True

@app.get("/")
def read_root():
    return {"message": "Task API with S3 and Gemini OCR is running!"}

@app.get("/api/tasks", response_model=List[TaskResponse])
def get_tasks(db: Session = Depends(get_db)):
    return db.query(models.Task).order_by(models.Task.id.desc()).all()

@app.post("/api/tasks", response_model=TaskResponse)
async def create_task(
    title: str = Form(...),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    image_url = None
    extracted_text = None

    if file:
        file_extension = file.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{file_extension}"
        content = await file.read()

        # 1. Amazon S3 アップロード
        try:
            s3_client.put_object(
                Bucket=S3_BUCKET_NAME,
                Key=filename,
                Body=content,
                ContentType=file.content_type
            )
            image_url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{filename}"
        except Exception as e:
            print(f"S3 Upload Error: {e}")
            raise HTTPException(status_code=500, detail=f"S3アップロード失敗: {str(e)}")

        # 2. AWS Textract 解析
        raw_ocr_text = ""
        try:
            response = textract_client.detect_document_text(
                Document={'Bytes': content}
            )
            detected_lines = []
            for block in response.get('Blocks', []):
                if block['BlockType'] == 'LINE':
                    detected_lines.append(block['Text'])
            
            if detected_lines:
                raw_ocr_text = "\n".join(detected_lines)
            else:
                raw_ocr_text = "文字が検出されませんでした。"
        except Exception as e:
            print(f"Textract Error: {e}")
            raw_ocr_text = f"【OCR解析エラー】: {str(e)}"

        # 3. Gemini API によるテキスト整形
        print(f"--- DEBUG: raw_ocr_text exists: {bool(raw_ocr_text)}")
        print(f"--- DEBUG: gemini_client exists: {bool(gemini_client)}")

        if raw_ocr_text and not raw_ocr_text.startswith("【OCR解析エラー】") and gemini_client:
            try:
                print("--- DEBUG: Calling Gemini API (google-genai)... ---")
                prompt = f"""
以下のレシート・文書のOCRテキストを解析し、人間が見やすいように綺麗に要約・整形してください。
無意味な記号や読み取りエラー（雑音テキスト）は除外してください。

🏪 **店舗名 / タイトル**: (判別できる場合)
📅 **日時**: (判別できる場合)
----------------------------------------
🛍️ **内容・品目**:
- (商品名や項目と金額)
----------------------------------------
💰 **合計金額**: (判別できる場合)

【OCR読み取りテキスト】
{raw_ocr_text}
"""
                gemini_response = gemini_client.models.generate_content(
                    model='gemini-3.8-flash',
                    contents=prompt,
                )
                extracted_text = gemini_response.text
                print("--- DEBUG: Gemini Response Success! ---")
            except Exception as e:
                print(f"--- DEBUG: Gemini API Exception: {e} ---")
                extracted_text = f"【AI整形失敗（生OCRデータ表示）】\n\n{raw_ocr_text}"
        else:
            print("--- DEBUG: Gemini API Skipped (Condition not met) ---")
            extracted_text = raw_ocr_text

    db_task = models.Task(
        title=title,
        image_url=image_url,
        extracted_text=extracted_text
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.patch("/api/tasks/{task_id}", response_model=TaskResponse)
def update_task_status(task_id: int, status: str = Form(...), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    task.status = status
    db.commit()
    db.refresh(task)
    return task

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    
    if task.image_url:
        try:
            filename = task.image_url.split("/")[-1]
            s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=filename)
        except Exception as e:
            print(f"S3 Delete Error: {e}")

    db.delete(task)
    db.commit()
    return {"message": "タスクを削除しました"}