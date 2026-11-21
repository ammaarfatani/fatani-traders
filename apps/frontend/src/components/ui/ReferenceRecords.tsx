'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { RecordActions } from './RecordActions';

export function ReferenceRecords() {
  const {data: categories = []} = useQuery({queryKey:['fabricCategories'],queryFn:()=>api.get<any[]>('/products/categories')});
  const {data: products = []} = useQuery({queryKey:['fabricRecords'],queryFn:()=>api.get<any[]>('/products')});
  return <details className="p-4 bg-white border rounded-xl"><summary className="font-semibold cursor-pointer">Fabric names and categories</summary>
    <p className="text-sm my-3">These records are created when purchasing fabric. Referenced records cannot be deleted.</p>
    <div className="space-y-4">{categories.map(c=><div key={c.id}><p className="font-semibold">{c.name}</p><RecordActions record={c} endpoint={`/products/categories/${c.id}`} label={c.name} fields={[{key:'name',label:'Name',required:true},{key:'description',label:'Description'}]} /></div>)}</div>
    <div className="space-y-4 mt-5">{products.map(p=><div key={p.id}><p className="font-semibold">{p.name}</p><RecordActions record={{...p,categoryId:p.category.id}} endpoint={`/products/${p.id}`} label={p.name} fields={[{key:'name',label:'Name',required:true},{key:'code',label:'Code'},{key:'description',label:'Description'},{key:'categoryId',label:'Category',options:categories.map(c=>({value:c.id,label:c.name}))}]} /></div>)}</div>
  </details>;
}
