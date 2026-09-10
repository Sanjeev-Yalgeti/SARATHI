import { X } from "lucide-react";

export default function PhotoProofViewer({ photoUrl, title, onClose }) {
  if (!photoUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full cursor-pointer transition-colors"
        >
          <X size={24} />
        </button>
        <img
          src={photoUrl}
          alt={title || "Incident Proof"}
          className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-white/10"
        />
        {title && (
          <div className="mt-3 text-white text-sm font-semibold bg-black/60 px-4 py-1.5 rounded-full border border-white/20">
            {title}
          </div>
        )}
      </div>
    </div>
  );
}
