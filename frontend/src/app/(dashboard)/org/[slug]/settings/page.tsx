import SettingsPage from './_components/SettingsPage';

interface Props {
  params: Promise<{ slug: string }>;
}

export default function Page({ params }: Props) {
  return <SettingsPage params={params} />;
}
