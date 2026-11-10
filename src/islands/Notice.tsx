import { useStore } from '@nanostores/preact';
import { $notice } from '@/lib/stores';
import { useInit } from './hooks';

export default function Notice() {
  useInit();
  const notice = useStore($notice);
  if (!notice) return null;
  return (
    <div class="toast" role="status">
      <span>{notice}</span>
      <button type="button" onClick={() => $notice.set(null)}>
        Rozumím
      </button>
    </div>
  );
}
