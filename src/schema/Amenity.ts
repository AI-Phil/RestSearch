import { Review } from './Review';

export interface Amenity {
    id: string;
    type: string;
    name: string;
    locality_name?: string;
    lat: number;
    lon: number;
    metadata: Record<string, unknown>;
    reviews: Review[];
}
