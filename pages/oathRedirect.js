import * as Realm from 'realm-web';
import { useEffect } from 'react';
import CircularProgress from "@material-ui/core/CircularProgress";

export default function useGoogleLoginRedirect() {
    useEffect(() => {
        Realm.handleAuthRedirect();
    }, [])
    return <CircularProgress />
  }

