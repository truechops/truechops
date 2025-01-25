import dynamic from 'next/dynamic';

export default function main() {
    const DynamicMain = dynamic(
        () => import('../src/components/byos/Main'),
        { ssr: false }
    )

    return (
        <DynamicMain />
    );
}