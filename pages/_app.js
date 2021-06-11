import { useEffect } from "react";
import Head from "next/head";
import { ThemeProvider } from "@material-ui/core/styles";
import CssBaseline from "@material-ui/core/CssBaseline";
import Theme from "../src/ui/Theme";
import Header from "../src/ui/Header";
import { Provider } from "react-redux";
import store from "../src/store/index";
import RealmApolloProvider from "../src/providers/RealmApolloProvider";

export default function MyApp(props) {
  const { Component, pageProps } = props;

  useEffect(() => {
    // Remove the server-side injected CSS.
    const jssStyles = document.querySelector("#jss-server-side");
    if (jssStyles) {
      jssStyles.parentElement.removeChild(jssStyles);
    }
  }, []);

  return (
    <>
      <Head>
        <title>My page</title>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width"
        />
      </Head>
      <Provider store={store}>
        <RealmApolloProvider>
          <ThemeProvider theme={Theme}>
            <CssBaseline />
            <Header />
            <Component {...pageProps} />
          </ThemeProvider>
        </RealmApolloProvider>
      </Provider>
    </>
  );
}
