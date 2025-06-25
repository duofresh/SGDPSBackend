import fs from 'fs/promises';

export async function readJSON(path: string): Promise<any> {
  try {
    const data = await fs.readFile(path, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

export async function writeJSON(path: string, data: any): Promise<void> {
  await fs.writeFile(path, JSON.stringify(data, null, 2));
}

export async function appendToJSON(path: string, item: any): Promise<void> {
  const data = await readJSON(path);
  data.push(item);
  await writeJSON(path, data);
}
