import AnalyticsPage from './_components/AnalyticsPage';

interface Props {
  params: Promise<{ slug: string }>;
}

export default function AnalyticsRoute({ params }: Props) {
  return <AnalyticsPage params={params} />;
}
