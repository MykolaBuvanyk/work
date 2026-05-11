import { Link } from 'react-router-dom';
import { getLocalizedPath } from '../utils/localizedPath';

export default function Link({ to, ...props }) {
  return (
    <Link
      to={getLocalizedPath(to)}
      {...props}
    />
  );
}