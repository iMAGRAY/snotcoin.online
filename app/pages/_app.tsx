import { AppProps } from 'next/app'
import Head from 'next/head'

// Создаем простой Layout заменяющий отсутствующий компонент
const Layout = ({ children }: { children: React.ReactNode }) => (
  <div className="app-layout">
    {children}
  </div>
);

// Упрощаем компонент без зависимостей от MUI
function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Snotcoin Game</title>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </>
  )
}

export default MyApp 