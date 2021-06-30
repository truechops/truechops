import React, { useEffect } from "react";
import Head from "next/head";
import { ThemeProvider } from "@material-ui/core/styles";
import CssBaseline from "@material-ui/core/CssBaseline";
import Theme from "../src/components/ui/Theme";
import HeaderToolbar from "../src/components/layout/HeaderToolbar";
import Navigation from "../src/components/layout/Navigation";
import { Provider } from "react-redux";
import store from "../src/store/index";
import RealmApolloProvider from "../src/providers/RealmApolloProvider";
import { ToneContextProvider } from "../src/store/tone-context";
import ReactGA from 'react-ga';
import ErrorBoundary from '../src/components/error/ErrorBoundary';

export default function MyApp(props) {
  const { Component, pageProps } = props;

  useEffect(() => {
    // Remove the server-side injected CSS.
    const jssStyles = document.querySelector("#jss-server-side");
    if (jssStyles) {
      jssStyles.parentElement.removeChild(jssStyles);
    }

    ReactGA.initialize('UA-146220050-1', {
      debug: true,
      titleCase: false
    });
  }, []);

  return (
    <ErrorBoundary>
      <Head>
        <title>My page</title>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width"
        />
      </Head>
      
        <Provider store={store}>
          <RealmApolloProvider>
          <ToneContextProvider>
            <ThemeProvider theme={Theme}>
              <CssBaseline />
              <HeaderToolbar />
              <Navigation />
              <Component {...pageProps} />
            </ThemeProvider>
            </ToneContextProvider>
          </RealmApolloProvider>
        </Provider>
    </ErrorBoundary>
  );
}
