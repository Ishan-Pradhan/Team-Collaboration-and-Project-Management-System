import KanbanPage from './_components/KanbanPage';

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default function Page({ params }: Props) {
  return <KanbanPage params={params} />;
}
