import { useQuery } from '@tanstack/react-query';
import { Star, User, MessageSquare } from 'lucide-react';
import { useApiClient } from '../lib/api.js';
import { formatDateTime } from '../lib/formatters.js';

export function ReviewsPage() {
    const api = useApiClient();

    const reviews = useQuery({
        queryKey: ['reviews', api.base],
        queryFn: () => api.get('/reviews').then((d) => d.reviews || []),
    });

    return (
        <div className="stack gap-lg">
            <div className="card">
                <div className="card-head">
                    <div>
                        <p className="eyebrow">Customer Voice</p>
                        <h3>All Reviews</h3>
                    </div>
                </div>

                <div className="grid two gap-md">
                    {(reviews.data || []).map((rev) => (
                        <div key={rev.id} className="card subtle stack gap-sm">
                            <div className="inline between">
                                <div className="inline gap-sm">
                                    <div className="avatar small">{rev.user_name?.[0] || 'A'}</div>
                                    <strong>{rev.user_name || 'Anonymous'}</strong>
                                </div>
                                <div className="pill info mono xs">{rev.rating} ★</div>
                            </div>
                            <p className="description" style={{ fontSize: '14px', fontStyle: 'italic' }}>
                                "{rev.comment || 'No comment provided.'}"
                            </p>
                            <div className="inline between muted xs">
                                <span className="mono">ID: {rev.product_id}</span>
                                <span>{formatDateTime(rev.created_at)}</span>
                            </div>
                        </div>
                    ))}
                    {reviews.isLoading && <div className="empty">Loading feedback...</div>}
                    {!reviews.isLoading && reviews.data?.length === 0 && (
                        <div className="empty">No customer reviews yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
