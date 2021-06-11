import EmailConfirmation from '../src/components/auth/EmailConfirmation';

export default function emailConfirmation(props) {
  return <EmailConfirmation token={props.token} tokenId={props.tokenId} />
}

export async function getServerSideProps({ query }) {
  const token = query.token ?? '';
  const tokenId = query.tokenId ?? '';

  return { props: { token, tokenId } };
}
