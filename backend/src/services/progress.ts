export function parseProgress(response: Response, size: number) {
  if (response.status === 200 || response.status === 201)
    return { offset: size, complete: true };
  const range = response.headers.get("range");
  return {
    offset: range ? Number(range.split("-")[1]) + 1 : 0,
    complete: false,
  };
}
