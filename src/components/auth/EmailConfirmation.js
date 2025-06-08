import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { useRouter } from "next/router";
import CircularProgress from "@mui/material/CircularProgress";
import { useTheme } from "@mui/styles";

export default function EmailConfirmation(props) {
  const app = useSelector((state) => state.realm.app);
  const dispatch = useDispatch();
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    const confirmUser = async () => {
      await app.emailPasswordAuth.confirmUser(props.token, props.tokenId);
      router.push("/login");
    };

    confirmUser();
  }, [app, dispatch, props.token, props.tokenId, router]);

  return <CircularProgress style={theme.spinner} color="primary" />;
}

export async function getServerSideProps({ query }) {
  const token = query.token ?? '';
  const tokenId = query.tokenId ?? '';

  return { props: { token, tokenId } };
}
