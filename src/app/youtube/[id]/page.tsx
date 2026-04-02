'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import {
  getYoutubeVideoById,
  deleteYoutubeVideo,
  updateYoutubeVideo,
  getGeminiModels,
  getGeminiPrompts,
  sendYoutubeEmailAction
} from '@/lib/db';
import { notFound, useRouter, useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/lib/utils';
import he from 'he';
import { useState, useEffect } from 'react';

interface YoutubeVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration: string;
  published_at: string;
  summary: string;
  description: string;
  added_at: string;
  user_id: string;
}

export default function YoutubeDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [video, setVideo] = useState<YoutubeVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('seokmin.kwon@samsung.com');

  // Edit states
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [editedDescription, setEditedDescription] = useState('');

  useEffect(() => {
    const lastEmail = localStorage.getItem('last_blog_email');
    if (lastEmail) setRecipientEmail(lastEmail);
  }, []);

  useEffect(() => {
    async function loadVideo() {
      if (!id) return;
      const data = await getYoutubeVideoById(id);
      if (data) {
        // Decode entities for all fields to ensure consistent display and editing
        const decodedData = {
          ...data,
          title: he.decode(data.title || ''),
          summary: he.decode(data.summary || ''),
          description: he.decode(data.description || '')
        };
        setVideo(decodedData);
        setEditedTitle(decodedData.title);
        setEditedSummary(decodedData.summary);
        setEditedDescription(decodedData.description);
      }
      setLoading(false);
    }
    loadVideo();
  }, [id]);

  if (loading) {
    return (
      <div className="font-display min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin text-primary">
          <span className="material-symbols-outlined text-4xl">sync</span>
        </div>
      </div>
    );
  }

  if (!video) {
    notFound();
  }

  const handleDelete = async () => {
    if (!confirm('정말로 이 기록을 삭제하시겠습니까?')) return;

    setIsDeleting(true);
    try {
      const result = await deleteYoutubeVideo(video.id);
      if (result.success) {
        alert('삭제되었습니다.');
        router.push('/?mode=youtube');
      } else {
        alert(`삭제 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(video?.url || '');
  };

  const handleEditToggle = () => {
    if (isEditingMode) {
      // Cancel editing, reset to current video data
      setEditedTitle(video?.title || '');
      setEditedSummary(video?.summary || '');
      setEditedDescription(video?.description || '');
      setIsEditingMode(false);
    } else {
      // Entering edit mode: sync edited fields with current video state
      setEditedTitle(video?.title || '');
      setEditedSummary(video?.summary || '');
      setEditedDescription(video?.description || '');
      setIsEditingMode(true);
    }
  };

  const handleSave = async () => {
    if (!video) return;
    setIsSaving(true);
    try {
      const result = await updateYoutubeVideo(video.id, {
        title: editedTitle,
        thumbnail: video.thumbnail,
        duration: video.duration,
        published_at: video.published_at,
        summary: editedSummary,
        description: editedDescription,
      });

      if (result.success) {
        setVideo({
          ...video,
          title: editedTitle,
          summary: editedSummary,
          description: editedDescription,
        });
        setIsEditingMode(false);
        alert('수정되었습니다.');
      } else {
        alert(`수정 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendEmail = async () => {
    if (!recipientEmail) {
      alert('이메일 주소를 입력해 주세요.');
      return;
    }

    setIsSending(true);
    try {
      const res = await sendYoutubeEmailAction(video!.id, recipientEmail);
      if (res.success) {
        localStorage.setItem('last_blog_email', recipientEmail);
        alert('이메일이 발송되었습니다.');
        setShowEmailModal(false);
      } else {
        alert(res.error);
      }
    } catch (err) {
      alert('이메일 발송에 실패했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  const handleRefetch = async () => {
    if (!confirm('AI를 사용하여 정보를 다시 가져오시겠습니까? 기존 요약 내용이 덮어씌워집니다.')) return;

    setIsRefetching(true);
    try {
      // Load user settings for Gemini
      const dbModels = await getGeminiModels();
      const dbPrompts = await getGeminiPrompts();

      const defaultModel = dbModels.find(m => m.is_default) || dbModels[0];
      const defaultPrompt = dbPrompts.find(p => p.is_default) || dbPrompts[0];

      const response = await fetch('/api/youtube/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: video.url,
          model: defaultModel?.name,
          prompt: defaultPrompt?.content
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to extract video info');

      const updateResult = await updateYoutubeVideo(video.id, {
        title: data.title || video.title,
        thumbnail: data.thumbnail || video.thumbnail,
        duration: data.duration || video.duration,
        published_at: data.publishDate || video.published_at,
        summary: data.summary || '',
        description: data.description || '',
      });

      if (updateResult.success) {
        setVideo({
          ...video,
          title: data.title || video.title,
          thumbnail: data.thumbnail || video.thumbnail,
          duration: data.duration || video.duration,
          published_at: data.publishDate || video.published_at,
          summary: data.summary || '',
          description: data.description || '',
        });
        alert('정보가 업데이트되었습니다.');
      } else {
        alert(`업데이트 실패: ${updateResult.error}`);
      }
    } catch (error) {
      console.error('Refetch error:', error);
      alert(`다시 가져오기 실패: ${error instanceof Error ? error.message : '오류가 발생했습니다.'}`);
    } finally {
      setIsRefetching(false);
    }
  };

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 overflow-x-hidden">
      <Header
        title="유튜브 기록"
        showBack
        rightAction={
          <div className="flex items-center gap-1">
            {isEditingMode ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="text-primary font-bold px-3 py-1 rounded-full hover:bg-primary/5 transition-colors flex items-center gap-1"
                >
                  <span className={cn("material-symbols-outlined text-xl", isSaving && "animate-spin")}>
                    {isSaving ? "sync" : "save"}
                  </span>
                  저장
                </button>
                <button
                  onClick={handleEditToggle}
                  disabled={isSaving}
                  className="text-slate-500 font-bold px-3 py-1 rounded-full hover:bg-slate-100 transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                  취소
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleEditToggle}
                  disabled={isRefetching || isDeleting}
                  className="text-primary hover:bg-primary/5 p-2 rounded-full transition-colors disabled:opacity-50"
                  title="내용 수정"
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button
                  onClick={handleRefetch}
                  disabled={isRefetching || isDeleting}
                  className="text-primary hover:bg-primary/5 p-2 rounded-full transition-colors disabled:opacity-50"
                  title="다시 가져오기"
                >
                  <span className={cn("material-symbols-outlined", isRefetching && "animate-spin")}>sync</span>
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting || isRefetching}
                  className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors disabled:opacity-50"
                  title="기록 삭제"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </>
            )}
          </div>
        }
      />

      <main className="p-4 space-y-6">
        <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-lg border border-slate-100 dark:border-primary/10">
           {/* eslint-disable-next-line @next/next/no-img-element */}
           <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
        </div>

        <div className="space-y-2">
          {isEditingMode ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">제목</label>
              <textarea
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="w-full text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-primary/20 focus:ring-2 focus:ring-primary/20 outline-none resize-none min-h-[100px]"
                placeholder="제목을 입력하세요"
              />
            </div>
          ) : (
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{video.title}</h1>
          )}
          <div className="flex gap-3 text-sm text-slate-500 dark:text-slate-400 font-medium">
             <span>{video.duration}</span>
             <span>•</span>
             <span>{video.published_at}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary text-sm font-bold"
            >
              <span className="material-symbols-outlined text-sm">link</span>
              유튜브에서 보기
            </a>
            <button
              onClick={handleCopyUrl}
              className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-primary text-sm font-bold transition-colors"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
              URL 복사
            </button>
            <button
              onClick={() => setShowEmailModal(true)}
              className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-primary text-sm font-bold transition-colors"
            >
              <span className="material-symbols-outlined text-sm">mail</span>
              메일 송부
            </button>
          </div>
        </div>

        <section className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
               <span className="material-symbols-outlined text-primary">auto_awesome</span>
               AI 요약 분석
            </h2>
            {isEditingMode ? (
              <textarea
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                className="w-full min-h-[300px] bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-primary/20 focus:ring-2 focus:ring-primary/20 outline-none resize-y text-sm leading-relaxed"
                placeholder="AI 요약 내용을 수정하세요 (마크다운 지원)"
              />
            ) : (
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-primary/10 prose dark:prose-invert prose-slate prose-sm max-w-none shadow-inner break-words overflow-x-hidden">
                 <ReactMarkdown
                   remarkPlugins={[remarkGfm, remarkBreaks]}
                   rehypePlugins={[rehypeRaw]}
                 >
                 {video.summary || ''}
                 </ReactMarkdown>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
               <span className="material-symbols-outlined text-slate-400">description</span>
               상세 설명
            </h2>
            {isEditingMode ? (
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="w-full min-h-[200px] bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-primary/20 focus:ring-2 focus:ring-primary/20 outline-none resize-y text-sm leading-relaxed"
                placeholder="상세 설명을 수정하세요"
              />
            ) : (
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-primary/10 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed shadow-inner break-words overflow-hidden">
                 {video.description || "설명이 없습니다."}
              </div>
            )}
          </div>
        </section>
      </main>

      <BottomNav activeTab="library" />

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">메일 송부 (Gmail)</h3>
              <button onClick={() => setShowEmailModal(false)} className="text-slate-400"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">수신인 이메일</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full rounded-xl border dark:border-primary/20 bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              onClick={handleSendEmail}
              disabled={isSending || !recipientEmail}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSending ? (
                <>
                  <span className="material-symbols-outlined animate-spin">sync</span>
                  발송 중...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">send</span>
                  보내기
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
