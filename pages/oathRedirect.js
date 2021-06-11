import * as Realm from 'realm-web';
import { useEffect } from 'react';
import CircularProgress from "@material-ui/core/CircularProgress";

export default function googleLoginRedirect(props) {
    useEffect(() => {
        Realm.handleAuthRedirect();
    }, [])
    return <CircularProgress />
  }

