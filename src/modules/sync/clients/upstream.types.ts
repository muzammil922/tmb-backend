export interface UpstreamDiscoverItem {
  _id?: string;
  id?: string;
  tmdbId?: number | string;
  tmdbid?: number | string;
  title?: string;
  name?: string;
}

export interface UpstreamDiscoverResponse {
  results?: UpstreamDiscoverItem[];
  result?: boolean | UpstreamDiscoverItem[];
  data?: UpstreamDiscoverItem[];
  page?: number;
  totalPages?: number;
  total?: number;
  totalResults?: number;
}
