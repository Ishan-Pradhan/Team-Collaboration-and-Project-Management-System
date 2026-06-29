import MembersPage from './_components/MembersPage';

interface Props {
  params: Promise<{ slug: string }>;
}

export default function Page({ params }: Props) {
  return <MembersPage params={params} />;
}
