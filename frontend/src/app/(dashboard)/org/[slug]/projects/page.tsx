import ProjectsPage from './_components/ProjectsPage';

interface Props {
  params: Promise<{ slug: string }>;
}

export default function Page({ params }: Props) {
  return <ProjectsPage params={params} />;
}
