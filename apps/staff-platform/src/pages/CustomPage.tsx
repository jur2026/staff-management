import { useParams } from 'react-router-dom';
import { settings } from 'zitejs/api';
import { Markdown } from '@project/components/markdown';
import { Card, CardContent } from '@project/components/ui/card';
import { LoadingRows, useLoad } from '../components/kit';

export default function CustomPage() {
  const { id = '' } = useParams();
  const { data, loading } = useLoad(() => settings({ action: 'page', id }) as Promise<{ id: string; title: string; content: string }>, [id]);
  if (loading || !data) return <LoadingRows rows={6} />;
  return <Card><CardContent className="p-6 sm:p-10"><Markdown>{data.content}</Markdown></CardContent></Card>;
}
