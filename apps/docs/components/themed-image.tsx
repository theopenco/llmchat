export function ThemedImage({
	alt,
	basePath,
}: {
	alt: string;
	basePath: string;
}) {
	return (
		<>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={`${basePath}-light.png`}
				alt={alt}
				className="block rounded-lg border dark:hidden"
			/>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={`${basePath}-dark.png`}
				alt={alt}
				className="hidden rounded-lg border dark:block"
			/>
		</>
	);
}
