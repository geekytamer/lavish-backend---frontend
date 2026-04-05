import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { Activity } from 'lucide-react';

export function AnalyticsPage() {
    const api = useApiClient();
    const { role, vendorId } = useApp();

    const analytics = useQuery({
        queryKey: ['analytics', api.base, role, vendorId],
        queryFn: () => role === 'vendor' ? api.get(`/analytics?vendorId=${vendorId}`) : api.get('/analytics'),
    });

    const products = analytics.data?.products || [];
    const vendors = analytics.data?.vendors || [];

    const totalProductClicks = products.reduce((acc, p) => acc + (p.clicks || 0), 0);
    const totalProductCarts = products.reduce((acc, p) => acc + (p.carts || 0), 0);
    // Profile views could also be removed, but we'll remove it per the "remove views" generic request.

    return (
        <div className="stack gap-lg">
            <div className="grid cards-2 gap-md">
                <StatCard label="Product Clicks" value={totalProductClicks} hint="Total product taps" />
                <StatCard label="Add to Carts" value={totalProductCarts} hint="Total products added to cart" />
            </div>

            <div className="card">
                <div className="card-head">
                    <div>
                        <p className="eyebrow">Analytics</p>
                        <h3>Products Engagement</h3>
                    </div>
                </div>
                <div className="table">
                    <div className="table-head">
                        <span>Product</span>
                        <span>Clicks</span>
                        <span>Likes</span>
                        <span>Shares</span>
                        <span>Carts</span>
                    </div>
                    {products.map(product => (
                        <div key={product.id} className="table-row">
                            <span className="truncate">{product.name}</span>
                            <span className="mono subtle">{product.clicks || 0}</span>
                            <span className="mono subtle">{product.likes || 0}</span>
                            <span className="mono subtle">{product.shares || 0}</span>
                            <span className="mono subtle">{product.carts || 0}</span>
                        </div>
                    ))}
                    {!analytics.isLoading && products.length === 0 && (
                        <div className="empty">No product data.</div>
                    )}
                </div>
            </div>

            {role === 'admin' && (
                <div className="card">
                    <div className="card-head">
                        <div>
                            <p className="eyebrow">Analytics</p>
                            <h3>Vendors Engagement</h3>
                        </div>
                    </div>
                    <div className="table">
                        <div className="table-head">
                            <span>Vendor</span>
                            <span>Clicks</span>
                            <span>Shares</span>
                            <span />
                            <span />
                        </div>
                        {vendors.map(vendor => (
                            <div key={vendor.id} className="table-row">
                                <span className="truncate">{vendor.name}</span>
                                <span className="mono subtle">{vendor.clicks || 0}</span>
                                <span className="mono subtle">{vendor.shares || 0}</span>
                                <span />
                                <span />
                            </div>
                        ))}
                        {!analytics.isLoading && vendors.length === 0 && (
                            <div className="empty">No vendor data.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
