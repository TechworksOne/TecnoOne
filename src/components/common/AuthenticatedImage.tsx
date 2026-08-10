import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import axios from 'axios';
import { getImageUrl } from '../../utils/getImageUrl';

function isPrivateUpload(url: string): boolean {
  try { return new URL(url, window.location.origin).pathname.startsWith('/uploads/'); }
  catch { return false; }
}

export function useAuthenticatedImageUrl(source?: string | null): string {
  const resolved = getImageUrl(source);
  const [objectUrl, setObjectUrl] = useState('');

  useEffect(() => {
    if (!resolved || !isPrivateUpload(resolved)) {
      setObjectUrl(resolved);
      return;
    }
    let active = true;
    let createdUrl = '';
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    axios.get(resolved, {
      responseType: 'blob',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).then(response => {
      if (!active) return;
      createdUrl = URL.createObjectURL(response.data);
      setObjectUrl(createdUrl);
    }).catch(() => {
      if (active) setObjectUrl('');
    });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [resolved]);

  return objectUrl;
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string | null };

export default function AuthenticatedImage({ src, alt = '', ...props }: Props) {
  const authenticatedSrc = useAuthenticatedImageUrl(src);
  if (!authenticatedSrc) return null;
  return <img src={authenticatedSrc} alt={alt} {...props} />;
}
