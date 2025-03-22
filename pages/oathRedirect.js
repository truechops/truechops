import * as Realm from 'realm-web';
import { useEffect } from 'react';
import CircularProgress from "@mui/material/CircularProgress";
import { useTheme } from '@mui/styles';

export default function useGoogleLoginRedirect() {
    const theme = useTheme();
    useEffect(() => {
        Realm.handleAuthRedirect();
    }, [])
    return <CircularProgress style={theme.spinner}/>
  }

