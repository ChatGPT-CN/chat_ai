import { appWithTranslation } from 'next-i18next';
import type { AppProps } from 'next/app';
import '../app/globals.css'; // Assuming global styles are here
import { AppWrapper } from '../contexts/AppContext';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AppWrapper>
      <Component {...pageProps} />
    </AppWrapper>
  );
}

export default appWithTranslation(MyApp);
