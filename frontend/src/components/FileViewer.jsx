import { X, Download, FileImage, FileText } from 'lucide-react';

export default function FileViewer({ url, filename, mime, onClose }) {
  if (!url) return null;
  const isImage = mime?.startsWith('image/');
  const isPdf = mime === 'application/pdf';
  const downloadUrl = `${url}${url.includes('?') ? '&' : '?'}download=1`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isImage ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
              {isImage ? <FileImage className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <span className="font-semibold text-sm text-slate-900 truncate">{filename}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href={downloadUrl} className="premium-btn-secondary text-xs py-2 px-3">
              <Download className="w-3.5 h-3.5" /> Download
            </a>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-slate-50 flex items-center justify-center">
          {isImage && <img src={url} alt={filename} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg" />}
          {isPdf && <iframe src={url} title={filename} className="w-full h-[70vh] rounded-lg shadow-sm bg-white" />}
          {!isImage && !isPdf && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">Preview not available</p>
              <p className="text-xs text-slate-400 mt-1">Use the download button to view this file</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}