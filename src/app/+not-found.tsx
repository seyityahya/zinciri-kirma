import { Redirect } from 'expo-router';

/** Tanınmayan bir bağlantıyla açılırsa ana ekrana dön. */
export default function NotFound() {
  return <Redirect href="/" />;
}
