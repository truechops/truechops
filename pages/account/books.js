import dynamic from "next/dynamic";
const BookAccount = dynamic(() => import("../../src/components/book-builder/BookAccount"), { ssr: false });
export default function BooksAccountPage() { return <BookAccount />; }
