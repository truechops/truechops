import { useEffect } from 'react';
import CircularProgress from "@mui/material/CircularProgress";
import { useTheme } from '@mui/styles';
import { useRouter } from 'next/router';

export default function useGoogleLoginRedirect() {
    const theme = useTheme();
    const router = useRouter();

    useEffect(() => {
        router.replace("/login");
    }, [router])

    return <CircularProgress style={theme.spinner}/>
  }
