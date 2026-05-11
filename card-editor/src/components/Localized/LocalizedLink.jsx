import { Link as RouterLink } from 'react-router-dom';
import {getLocalizedPath} from '../../utils/localizedPath'

export default function Link({ to, ...props }) {
  return (
    <RouterLink
      to={getLocalizedPath(to)}
      {...props}
    />
  );
}