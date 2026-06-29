import OrgOverviewPage from './_components/OrgOverviewPage';

interface Props {
  params: Promise<{ slug: string }>;
}

export default function Page({ params }: Props) {
  return <OrgOverviewPage params={params} />;
}
