import Main from '../src/components/compose/Main';

/**
 * 
 * @returns <Container maxWidth="sm">
      <Box my={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Next.js example
        </Typography>
        <Link href="/about" color="secondary">
          Go to the about page
        </Link>
        <ProTip />
        <Copyright />
      </Box>
    </Container>
 */
export default function Index() {
  return (
    <Main />
  );
}
