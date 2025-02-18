export function BouncingDots() {
  const dotCount = 5;

  return (
    <span className="flex flex-row items-center">
      {Array.from({ length: dotCount }).map((_, index) => (
        <span
          key={index}
          className="inline-block animate-bounce text-2xl"
          style={{ animationDelay: `${index * 0.2}s` }}
        >
          .
        </span>
      ))}
    </span>
  );
}
