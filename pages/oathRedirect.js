import * as Realm from 'realm-web';
import { useEffect } from 'react';
import CircularProgress from "@material-ui/core/CircularProgress";
import { useTheme } from '@material-ui/styles';

export default function useGoogleLoginRedirect() {
    const theme = useTheme();
    useEffect(() => {
        Realm.handleAuthRedirect();
    }, [])
    return <CircularProgress style={theme.spinner}/>
  }

