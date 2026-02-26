import { MatrixRain } from './MatrixRain';

export function SpaceBackground(): React.JSX.Element {
    return (
        <div className="space-bg" aria-hidden="true">
            <div className="space-bg__nebula space-bg__nebula--1" />
            <div className="space-bg__nebula space-bg__nebula--2" />
            <div className="space-bg__nebula space-bg__nebula--3" />
            <div className="space-bg__nebula space-bg__nebula--4" />
            <div className="space-bg__galaxy" />
            <MatrixRain />
        </div>
    );
}
