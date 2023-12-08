export interface Review {
    id?: string;
    reviewer: string;
    rating: number;
    review_text: string;
    similarity?: number;
}
