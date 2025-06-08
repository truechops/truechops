import { useEffect }  from 'react';
import { useTheme } from '@mui/styles';
import { useDispatch } from "react-redux";
import { appActions } from '../src/store/app';

export default function About() {
  const theme = useTheme();
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(appActions.setPageLoaded());
  }, [dispatch]);
  return (
    <div style={{...theme.spinner, marginLeft: -135}}>
      Originated by Jared Simon, based out of Kansas City. 
      <br />
      Open source project.
      <br />
      Questions/concerns/interested in contributing: contact jared@truechops.com
    </div>
  );
}
