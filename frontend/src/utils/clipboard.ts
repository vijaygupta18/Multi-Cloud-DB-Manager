import toast from 'react-hot-toast';

export const copyToClipboard = async (value: any) => {
  const text = value === null ? 'NULL' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied', { duration: 1500 });
  } catch {
    toast.error('Failed to copy');
  }
};
