/*
# Add admin DELETE policy for inquiries

1. Security Changes
- Adds a DELETE policy on the `inquiries` table allowing admin users (role = 'admin') to delete 1:1 inquiry posts.
- Matches the existing admin SELECT and UPDATE policy pattern (EXISTS check on profiles.role = 'admin').
*/

DROP POLICY IF EXISTS "admin_delete_inquiries" ON inquiries;
CREATE POLICY "admin_delete_inquiries"
ON inquiries FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);
