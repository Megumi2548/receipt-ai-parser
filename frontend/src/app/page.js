'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tasks`);
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error('タスク取得エラー:', error);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('title', title);
    if (file) {
      formData.append('file', file);
    }

    try {
      const res = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setTitle('');
        setFile(null);
        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.value = '';
        fetchTasks();
      }
    } catch (error) {
      console.error('タスク作成エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // ステータス（完了/未完了）の切り替え
  const toggleStatus = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const formData = new FormData();
    formData.append('status', newStatus);

    try {
      const res = await fetch(`${API_URL}/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: formData,
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error('ステータス更新エラー:', error);
    }
  };

  // タスク削除
  const handleDelete = async (id) => {
    if (!confirm('このタスクを削除しますか？ (S3の画像も削除されます)')) return;

    try {
      const res = await fetch(`${API_URL}/api/tasks/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error('タスク削除エラー:', error);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-8 text-center">
          OCR Task Manager
        </h1>

        {/* 投稿フォーム */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                タスク名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: レシートの経費精算"
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                画像添付 (OCR解析対象)
              </label>
              <input
                id="file-input"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
            >
              {loading ? 'S3アップロード & OCR処理中...' : 'タスクを保存する'}
            </button>
          </form>
        </div>

        {/* タスク一覧 */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">タスク一覧</h2>
          {tasks.length === 0 ? (
            <p className="text-slate-500 text-center py-8">タスクはまだありません。</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`bg-white p-5 rounded-xl shadow-sm border transition ${
                  task.status === 'completed' ? 'border-slate-200 bg-slate-50 opacity-75' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={task.status === 'completed'}
                      onChange={() => toggleStatus(task)}
                      className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <h3
                      className={`font-semibold text-lg ${
                        task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800'
                      }`}
                    >
                      {task.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleDelete(task.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                  >
                    削除
                  </button>
                </div>

                {/* 添付画像 */}
                {task.image_url && (
                  <div className="mt-3">
                    <img
                      src={task.image_url}
                      alt={task.title}
                      className="max-h-48 rounded-lg border border-slate-200 object-cover"
                    />
                  </div>
                )}

                {/* OCR抽出テキスト */}
                {task.extracted_text && (
                  <div className="mt-3 bg-slate-100 p-3 rounded-lg border border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 mb-1">🔍 AI/OCR 解析結果:</p>
                    <p className="text-sm text-slate-700 font-mono whitespace-pre-wrap">
                      {task.extracted_text}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}