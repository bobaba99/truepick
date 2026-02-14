type EmbeddingResponse = {
  data: { embedding: number[] }[]
}

export const getEmbeddings = async (
  apiKey: string,
  inputs: string[]
): Promise<number[][]> => {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: inputs,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI embeddings error: ${response.status}`)
  }

  const data = (await response.json()) as EmbeddingResponse
  return data.data.map((item) => item.embedding)
}
